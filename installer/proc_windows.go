//go:build windows

package main

import (
	"os/exec"
	"strings"
	"syscall"
	"time"
)

func hidden(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return cmd
}

func isRunning(exe string) bool {
	out, err := hidden(exec.Command("tasklist", "/FI", "IMAGENAME eq "+exe, "/NH")).Output()
	return err == nil && strings.Contains(strings.ToLower(string(out)), strings.ToLower(exe))
}

// CloseDiscord beendet Discord, damit die Dateien nicht gesperrt sind.
// Gibt zurück, ob Discord lief.
func CloseDiscord(branch string) bool {
	exe := exeNameFor(branch)
	if !isRunning(exe) {
		return false
	}
	_ = hidden(exec.Command("taskkill", "/F", "/IM", exe)).Run()
	for i := 0; i < 20 && isRunning(exe); i++ {
		time.Sleep(250 * time.Millisecond)
	}
	time.Sleep(500 * time.Millisecond)
	return true
}

func StartDiscord(di DiscordInstall) {
	upd := di.Path + `\Update.exe`
	_ = exec.Command(upd, "--processStart", exeNameFor(di.Branch)).Start()
}

func OpenBrowser(url string) {
	_ = hidden(exec.Command("rundll32", "url.dll,FileProtocolHandler", url)).Start()
}

func OpenFolder(p string) {
	_ = exec.Command("explorer", p).Start()
}
