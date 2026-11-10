package main

// Lädt xImJxstinnCord (Vencord-basiert) vom GitHub-Release "devbuild" herunter.

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var ModVersion = "dev" // wird beim Build per -ldflags gesetzt

const (
	Repo       = "ximjxstinn/ximjxstinncord"
	ReleaseAPI = "https://api.github.com/repos/" + Repo + "/releases/tags/devbuild"
	userAgent  = "xImJxstinnCord-Installer"
)

var httpClient = &http.Client{Timeout: 90 * time.Second}

// DataDir: %APPDATA%\xImJxstinnCord (nur die Programmdateien – Einstellungen, Plugins
// und Themes liegen wie bei Vencord in %APPDATA%\Vencord)
func DataDir() string {
	if d := os.Getenv("XJCORD_DATA_DIR"); d != "" {
		return d
	}
	if a := os.Getenv("APPDATA"); a != "" {
		return filepath.Join(a, "xImJxstinnCord")
	}
	h, _ := os.UserHomeDir()
	return filepath.Join(h, ".config", "xImJxstinnCord")
}

func SettingsDir() string {
	if a := os.Getenv("APPDATA"); a != "" {
		return filepath.Join(a, "Vencord")
	}
	h, _ := os.UserHomeDir()
	return filepath.Join(h, ".config", "Vencord")
}

func DistDir() string     { return filepath.Join(DataDir(), "dist") }
func PatcherPath() string { return filepath.Join(DistDir(), "patcher.js") }

type release struct {
	Name   string `json:"name"`
	Assets []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
	} `json:"assets"`
}

// InstallModFiles lädt die neueste Version nach %APPDATA%\xImJxstinnCord\dist.
func InstallModFiles(log func(string)) error {
	url := ReleaseAPI
	if u := os.Getenv("XJ_TEST_RELEASE_URL"); u != "" { // nur für Tests
		url = u
	}
	log("Suche neueste xImJxstinnCord-Version …")
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", userAgent)
	res, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("GitHub nicht erreichbar: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("GitHub antwortete mit %s", res.Status)
	}
	var rel release
	if err := json.NewDecoder(res.Body).Decode(&rel); err != nil {
		return err
	}
	log("Gefunden: " + rel.Name)

	if err := os.MkdirAll(DistDir(), 0o755); err != nil {
		return err
	}
	_ = os.WriteFile(filepath.Join(DistDir(), "package.json"), []byte("{}"), 0o644)

	needed := map[string]bool{"patcher.js": false, "preload.js": false, "renderer.js": false, "renderer.css": false}
	for _, a := range rel.Assets {
		if _, ok := needed[a.Name]; !ok {
			continue
		}
		log("Lade " + a.Name + " …")
		if err := download(a.URL, filepath.Join(DistDir(), a.Name)); err != nil {
			return fmt.Errorf("%s: %w", a.Name, err)
		}
		needed[a.Name] = true
	}
	for n, ok := range needed {
		if !ok {
			return errors.New("Datei fehlt im Release: " + n)
		}
	}
	ver := rel.Name[strings.LastIndex(rel.Name, " ")+1:]
	return os.WriteFile(filepath.Join(DistDir(), "version.txt"), []byte(ver), 0o644)
}

func download(url, dest string) error {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", userAgent)
	res, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return errors.New(res.Status)
	}
	tmp := dest + ".download"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	n, err := io.Copy(f, res.Body)
	f.Close()
	if err == nil && res.ContentLength > 0 && n != res.ContentLength {
		err = fmt.Errorf("unvollständig (%d von %d Bytes)", n, res.ContentLength)
	}
	if err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, dest)
}

func InstalledModVersion() string {
	b, err := os.ReadFile(filepath.Join(DistDir(), "version.txt"))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

// OtherModLoaded erkennt, ob die app.asar noch auf einen anderen Mod zeigt.
func OtherModLoaded(di DiscordInstall) string {
	if !di.Patched {
		return ""
	}
	b, err := os.ReadFile(filepath.Join(di.Resources, "app.asar"))
	if err != nil {
		return ""
	}
	s := strings.ToLower(string(b))
	switch {
	case strings.Contains(s, "ximjxstinncord"):
		return ""
	case strings.Contains(s, "vencord"):
		return "Vencord"
	case strings.Contains(s, "betterdiscord"):
		return "BetterDiscord"
	default:
		return "anderer Mod"
	}
}
