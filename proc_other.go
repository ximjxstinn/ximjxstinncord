//go:build !windows

package main

// Nur zum Testen auf anderen Systemen – der Installer ist für Windows gedacht.

import (
	"fmt"
	"os/exec"
)

func CloseDiscord(branch string) bool { return false }
func StartDiscord(di DiscordInstall)  {}
func OpenBrowser(url string) {
	fmt.Println("Öffne im Browser:", url)
	_ = exec.Command("xdg-open", url).Start()
}
func OpenFolder(p string) { _ = exec.Command("xdg-open", p).Start() }
