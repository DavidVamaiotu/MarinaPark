Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir
command = """" & scriptDir & "\MarinaPark.bat"" --background --no-update"

shell.Run command, 0, False
