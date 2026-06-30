package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func main() {
	executable, err := os.Executable()
	if err != nil {
		fmt.Printf("Nu pot determina directorul Marina Park: %v\n", err)
		return
	}

	root := filepath.Dir(executable)
	arguments := []string{
		"-NoProfile",
		"-ExecutionPolicy", "Bypass",
		"-File", filepath.Join(root, "MarinaPark.ps1"),
	}

	foreground := false
	if len(os.Args) > 1 {
		switch strings.ToLower(os.Args[1]) {
		case "--background":
			arguments = append(arguments, os.Args[1:]...)
		case "--foreground":
			arguments = append(arguments, "--foreground")
			foreground = true
		default:
			arguments = append(arguments, "--launcher")
		}
	} else {
		arguments = append(arguments, "--launcher")
	}

	command := exec.Command("powershell.exe", arguments...)
	command.Dir = root
	command.Stdin = os.Stdin
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr

	if err := command.Run(); err != nil {
		fmt.Printf("Marina Park nu a putut porni: %v\n", err)
	}

	if foreground {
		fmt.Print("Apasa Enter pentru inchidere")
		_, _ = bufio.NewReader(os.Stdin).ReadString('\n')
	}
}
