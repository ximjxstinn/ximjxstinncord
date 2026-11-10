//go:build !windows

package main

// Auf anderen Systemen (nur zum Testen) gibt es kein App-Fenster.
func runApp() bool { return false }
