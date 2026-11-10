//go:build windows

package main

// Eigenes App-Fenster über WebView2 (in Windows 10/11 eingebaut).

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/jchv/go-webview2"
)

func runApp() bool {
	dataPath := filepath.Join(os.Getenv("LOCALAPPDATA"), "xImJxstinnCord", "installer-webview")
	_ = os.MkdirAll(dataPath, 0o755)

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		DataPath:  dataPath,
		WindowOptions: webview2.WindowOptions{
			Title:  "xImJxstinnCord Installer",
			Width:  780,
			Height: 860,
			IconId: 2, // Icon aus der eingebetteten Ressource
			Center: true,
		},
	})
	if w == nil {
		return false // WebView2 nicht verfügbar → Browser-Modus
	}
	defer w.Destroy()
	w.SetSize(700, 640, webview2.HintMin)

	// Aufrufe laufen im Hintergrund, damit das Fenster nicht einfriert.
	// Das Ergebnis kommt per window.__xjDone(id, ergebnis) zurück.
	_ = w.Bind("xjCall", func(id string, action string, body json.RawMessage) bool {
		go func() {
			res := dispatch(action, body)
			b, _ := json.Marshal(res)
			idJSON, _ := json.Marshal(id)
			w.Dispatch(func() {
				w.Eval("window.__xjDone && window.__xjDone(" + string(idJSON) + "," + string(b) + ")")
			})
		}()
		return true
	})

	w.SetHtml(strings.Replace(indexHTML, "__TOKEN__", "", 1))
	w.Run()
	return true
}
