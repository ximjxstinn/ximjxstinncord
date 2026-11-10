package main

import (
	"embed"
	"os"
	"path/filepath"
	"strings"
)

//go:embed mod/patcher.js mod/preload.js mod/renderer.js mod/examples
var modFiles embed.FS

var ModVersion = "1.0.0" // wird beim Release per -ldflags gesetzt

// DataDir: %APPDATA%\xImJxstinnCord
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

func DistDir() string     { return filepath.Join(DataDir(), "dist") }
func PatcherPath() string { return filepath.Join(DistDir(), "patcher.js") }

// InstallModFiles schreibt die eingebauten Mod-Dateien nach %APPDATA%\xImJxstinnCord\dist.
func InstallModFiles() error {
	if err := os.MkdirAll(DistDir(), 0o755); err != nil {
		return err
	}
	// leeres package.json, damit Node nicht in Elternordnern sucht
	if err := os.WriteFile(filepath.Join(DistDir(), "package.json"), []byte("{}"), 0o644); err != nil {
		return err
	}
	for _, name := range []string{"patcher.js", "preload.js", "renderer.js"} {
		b, err := modFiles.ReadFile("mod/" + name)
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(DistDir(), name), b, 0o644); err != nil {
			return err
		}
	}
	if err := os.WriteFile(filepath.Join(DistDir(), "version.txt"), []byte(ModVersion), 0o644); err != nil {
		return err
	}
	installExamples()
	return nil
}

// installExamples legt Beispiel-Plugin und Beispiel-Theme an (nur beim ersten Mal).
func installExamples() {
	marker := filepath.Join(DataDir(), ".examples-installed")
	if fileExists(marker) {
		return
	}
	for dir, file := range map[string]string{"plugins": "beispiel-plugin.js", "themes": "xImJxstinn-Glow.theme.css"} {
		target := filepath.Join(DataDir(), dir)
		_ = os.MkdirAll(target, 0o755)
		if b, err := modFiles.ReadFile("mod/examples/" + file); err == nil && !fileExists(filepath.Join(target, file)) {
			_ = os.WriteFile(filepath.Join(target, file), b, 0o644)
		}
	}
	_ = os.WriteFile(marker, []byte("1"), 0o644)
}

func InstalledModVersion() string {
	b, err := os.ReadFile(filepath.Join(DistDir(), "version.txt"))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

// OtherModLoaded erkennt, ob die app.asar noch auf einen anderen Mod (z. B. Vencord) zeigt.
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
