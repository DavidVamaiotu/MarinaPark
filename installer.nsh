!macro customInstall
  IfFileExists "$APPDATA\Marina Park\data\marina-park.sqlite" marina_migration_done 0
  IfFileExists "$EXEDIR\data\marina-park.sqlite" 0 marina_migration_done
  CreateDirectory "$APPDATA\Marina Park"
  FileOpen $0 "$APPDATA\Marina Park\legacy-install-path.txt" w
  FileWrite $0 "$EXEDIR"
  FileClose $0
marina_migration_done:
!macroend
