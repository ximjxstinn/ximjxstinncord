package main

// Discord finden, patchen und entpatchen.
// Die Patch-Methode entspricht dem offiziellen Vencord Installer (GPL-3.0):
// resources/app.asar -> _app.asar umbenennen und eine kleine app.asar schreiben,
// die Vencords patcher.js lädt.

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type DiscordInstall struct {
	Branch    string `json:"branch"`
	Name      string `json:"name"`
	Path      string `json:"path"`
	Resources string `json:"resources"`
	Version   string `json:"version"`
	Patched   bool   `json:"patched"`
}

var branches = []struct{ Branch, Dir, Name string }{
	{"stable", "Discord", "Discord"},
	{"ptb", "DiscordPTB", "Discord PTB"},
	{"canary", "DiscordCanary", "Discord Canary"},
	{"dev", "DiscordDevelopment", "Discord Development"},
}

func exeNameFor(branch string) string {
	for _, b := range branches {
		if b.Branch == branch {
			return b.Dir + ".exe"
		}
	}
	return "Discord.exe"
}

func FindDiscords() []DiscordInstall {
	out := []DiscordInstall{}
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		return out
	}
	for _, b := range branches {
		p := filepath.Join(base, b.Dir)
		entries, err := os.ReadDir(p)
		if err != nil {
			continue
		}
		var apps []string
		for _, e := range entries {
			if e.IsDir() && strings.HasPrefix(e.Name(), "app-") {
				if fileExists(filepath.Join(p, e.Name(), "resources")) {
					apps = append(apps, e.Name())
				}
			}
		}
		if len(apps) == 0 {
			continue
		}
		sort.Slice(apps, func(i, j int) bool { return versionLess(apps[i], apps[j]) })
		latest := apps[len(apps)-1]
		res := filepath.Join(p, latest, "resources")
		out = append(out, DiscordInstall{
			Branch:    b.Branch,
			Name:      b.Name,
			Path:      p,
			Resources: res,
			Version:   strings.TrimPrefix(latest, "app-"),
			Patched:   fileExists(filepath.Join(res, "_app.asar")),
		})
	}
	return out
}

// versionLess vergleicht "app-1.0.9175" numerisch statt als Text.
func versionLess(a, b string) bool {
	pa := strings.Split(strings.TrimPrefix(a, "app-"), ".")
	pb := strings.Split(strings.TrimPrefix(b, "app-"), ".")
	for i := 0; i < len(pa) && i < len(pb); i++ {
		na, _ := strconv.Atoi(pa[i])
		nb, _ := strconv.Atoi(pb[i])
		if na != nb {
			return na < nb
		}
	}
	return len(pa) < len(pb)
}

func Patch(di DiscordInstall, patcherPath string) error {
	appAsar := filepath.Join(di.Resources, "app.asar")
	backup := filepath.Join(di.Resources, "_app.asar")

	if fileExists(backup) {
		// Schon gepatcht: nur unsere app.asar neu schreiben (zeigt evtl. auf neuen Pfad)
		return writeAppAsar(appAsar, patcherPath)
	}
	if !fileExists(appAsar) {
		return errors.New("app.asar nicht gefunden in " + di.Resources)
	}
	if err := os.Rename(appAsar, backup); err != nil {
		return busyErr(err)
	}
	if err := writeAppAsar(appAsar, patcherPath); err != nil {
		_ = os.Rename(backup, appAsar) // rückgängig machen
		return err
	}
	return nil
}

func Unpatch(di DiscordInstall) error {
	appAsar := filepath.Join(di.Resources, "app.asar")
	backup := filepath.Join(di.Resources, "_app.asar")
	tmp := filepath.Join(di.Resources, "app.asar.tmp")
	if !fileExists(backup) {
		return nil // nicht gepatcht
	}
	if fileExists(appAsar) {
		if err := os.Rename(appAsar, tmp); err != nil {
			return busyErr(err)
		}
	}
	if err := os.Rename(backup, appAsar); err != nil {
		_ = os.Rename(tmp, appAsar)
		return busyErr(err)
	}
	_ = os.RemoveAll(tmp)
	return nil
}

func busyErr(err error) error {
	if errors.Is(err, os.ErrPermission) || strings.Contains(strings.ToLower(err.Error()), "used by another process") {
		return fmt.Errorf("Discord-Dateien sind gerade in Benutzung. Schließe Discord komplett (auch im Tray) und versuche es nochmal: %w", err)
	}
	return err
}

type asarEntry struct {
	Size   int    `json:"size"`
	Offset string `json:"offset"`
}

// writeAppAsar schreibt ein minimales asar-Archiv mit index.js + package.json.
func writeAppAsar(outFile, patcherPath string) error {
	p, _ := json.Marshal(patcherPath)
	indexJs := "require(" + string(p) + ")"
	pkgJson := `{"name":"discord","main":"index.js"}`

	header := map[string]map[string]asarEntry{"files": {
		"index.js":     {Size: len(indexJs), Offset: "0"},
		"package.json": {Size: len(pkgJson), Offset: strconv.Itoa(len(indexJs))},
	}}
	hb, _ := json.Marshal(header)
	h := string(hb)
	hLen := uint32(len(h))
	aligned := (hLen + 3) &^ 3
	h += strings.Repeat("0", int(aligned-hLen)) // wie im offiziellen Installer

	f, err := os.Create(outFile)
	if err != nil {
		return fmt.Errorf("konnte %s nicht erstellen: %w", outFile, err)
	}
	defer f.Close()
	for _, n := range []uint32{4, aligned + 8, aligned + 4, hLen} {
		if err := binary.Write(f, binary.LittleEndian, n); err != nil {
			return err
		}
	}
	if _, err := f.WriteString(h + indexJs + pkgJson); err != nil {
		return err
	}
	return nil
}

func fileExists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}
