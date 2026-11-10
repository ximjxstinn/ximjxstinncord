package main

// xImJxstinnCord Installer – installiert den eigenen Discord-Mod.
// Läuft als eigenes App-Fenster (WebView2). Falls WebView2 fehlt, öffnet sich die
// Oberfläche ersatzweise im Browser (nur 127.0.0.1, mit Zufalls-Token).

import (
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

//go:embed ui/index.html
var indexHTML string

var actionMu sync.Mutex

func main() {
	if runApp() { // eigenes Fenster
		return
	}
	runBrowser() // Ersatz: im Browser
}

// ---------------------------------------------------------------------------
// Aktionen (werden von App-Fenster und Browser-Modus gemeinsam benutzt)
// ---------------------------------------------------------------------------

type actionReq struct {
	Branches []string `json:"branches"`
	Restart  bool     `json:"restart"`
	Settings bool     `json:"settings"`
}

type actionRes struct {
	OK  bool     `json:"ok"`
	Log []string `json:"log"`
}

type installView struct {
	DiscordInstall
	Other string `json:"other"`
}

func dispatch(action string, body []byte) any {
	var q actionReq
	_ = json.Unmarshal(body, &q)
	switch action {
	case "state":
		return doState()
	case "install":
		return doInstall(q)
	case "uninstall":
		return doUninstall(q)
	case "open":
		_ = os.MkdirAll(DataDir(), 0o755)
		OpenFolder(DataDir())
		return map[string]bool{"ok": true}
	case "ping":
		return map[string]bool{"ok": true}
	}
	return map[string]string{"error": "unbekannte Aktion"}
}

func selected(branches []string) []DiscordInstall {
	want := map[string]bool{}
	for _, b := range branches {
		want[b] = true
	}
	var out []DiscordInstall
	for _, d := range FindDiscords() {
		if want[d.Branch] {
			out = append(out, d)
		}
	}
	return out
}

func doState() any {
	list := []installView{}
	for _, d := range FindDiscords() {
		list = append(list, installView{d, OtherModLoaded(d)})
	}
	return map[string]any{
		"discords":  list,
		"installed": InstalledModVersion(),
		"bundled":   ModVersion,
		"dataDir":   DataDir(),
	}
}

func doInstall(q actionReq) actionRes {
	actionMu.Lock()
	defer actionMu.Unlock()
	res := actionRes{}
	log := func(s string) { res.Log = append(res.Log, s) }

	targets := selected(q.Branches)
	if len(targets) == 0 {
		log("Bitte wähle mindestens eine Discord-Installation aus.")
		return res
	}
	if err := InstallModFiles(); err != nil {
		log("❌ Mod-Dateien konnten nicht gespeichert werden: " + err.Error())
		return res
	}
	log("✅ xImJxstinnCord " + ModVersion + " gespeichert")

	allOK := true
	for _, d := range targets {
		if other := OtherModLoaded(d); other != "" {
			log("↪ " + d.Name + ": " + other + " wird durch xImJxstinnCord ersetzt")
		}
		wasRunning := CloseDiscord(d.Branch)
		if wasRunning {
			log(d.Name + " wurde geschlossen")
		}
		if err := Patch(d, PatcherPath()); err != nil {
			log("❌ " + d.Name + ": " + err.Error())
			allOK = false
			continue
		}
		log("✅ " + d.Name + " (" + d.Version + ") gepatcht")
		if wasRunning || q.Restart {
			StartDiscord(d)
			log(d.Name + " wird gestartet …")
		}
	}
	res.OK = allOK
	if allOK {
		log("🎉 Fertig! In Discord findest du alles unter Benutzereinstellungen → xImJxstinnCord.")
	}
	return res
}

func doUninstall(q actionReq) actionRes {
	actionMu.Lock()
	defer actionMu.Unlock()
	res := actionRes{OK: true}
	log := func(s string) { res.Log = append(res.Log, s) }

	targets := selected(q.Branches)
	if len(targets) == 0 {
		res.OK = false
		log("Bitte wähle mindestens eine Discord-Installation aus.")
		return res
	}
	for _, d := range targets {
		wasRunning := CloseDiscord(d.Branch)
		if err := Unpatch(d); err != nil {
			res.OK = false
			log("❌ " + d.Name + ": " + err.Error())
			continue
		}
		log("✅ " + d.Name + " ist wieder original")
		if wasRunning {
			StartDiscord(d)
		}
	}
	stillUsed := false
	for _, d := range FindDiscords() {
		if d.Patched && OtherModLoaded(d) == "" {
			stillUsed = true
		}
	}
	if q.Settings && stillUsed {
		log("Einstellungen behalten – eine andere Discord-Version nutzt xImJxstinnCord noch")
	} else if q.Settings {
		if err := os.RemoveAll(DataDir()); err == nil {
			log("🗑 Einstellungen, Plugins, Themes und Mod-Dateien gelöscht")
		}
	}
	return res
}

// ---------------------------------------------------------------------------
// Ersatz-Modus: Oberfläche im Browser
// ---------------------------------------------------------------------------

func runBrowser() {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	token := hex.EncodeToString(b)
	var pingMu sync.Mutex
	lastPing := time.Now()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Println("Konnte keinen lokalen Port öffnen:", err)
		os.Exit(1)
	}
	url := fmt.Sprintf("http://%s/?t=%s", ln.Addr().String(), token)

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" || r.URL.Query().Get("t") != token {
			http.Error(w, "Nicht erlaubt", http.StatusForbidden)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte(strings.Replace(indexHTML, "__TOKEN__", token, 1)))
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Token") != token || r.Method != http.MethodPost {
			http.Error(w, "Nicht erlaubt", http.StatusForbidden)
			return
		}
		pingMu.Lock()
		lastPing = time.Now()
		pingMu.Unlock()
		body := make([]byte, 0, 512)
		buf := make([]byte, 4096)
		for len(body) < 1<<16 {
			n, err := r.Body.Read(buf)
			body = append(body, buf[:n]...)
			if err != nil {
				break
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(dispatch(strings.TrimPrefix(r.URL.Path, "/api/"), body))
	})

	go func() {
		time.Sleep(60 * time.Second)
		for {
			time.Sleep(5 * time.Second)
			pingMu.Lock()
			idle := time.Since(lastPing)
			pingMu.Unlock()
			if idle > 45*time.Second && actionMu.TryLock() {
				os.Exit(0)
			}
		}
	}()

	OpenBrowser(url)
	_ = http.Serve(ln, mux)
}
