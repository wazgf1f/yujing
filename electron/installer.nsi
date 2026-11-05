Unicode True
SetCompressor /SOLID lzma

Name "语镜"
OutFile "语镜安装程序.exe"
InstallDir "$LOCALAPPDATA\Yujing"
InstallDirRegKey HKCU "Software\Yujing" "InstallDir"
RequestExecutionLevel user

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "语镜"
VIAddVersionKey "FileVersion" "1.0.0"
VIAddVersionKey "FileDescription" "语镜 LinguaMirror - 外语语用得体性教练"
VIAddVersionKey "CompanyName" "大连外国语大学软件学院"

Page directory
Page instfiles

Section "安装"
  SetOutPath "$INSTDIR"
  File /r "语镜-win32-x64\*.*"
  WriteUninstaller "$INSTDIR\卸载.exe"
  CreateShortcut "$DESKTOP\语镜.lnk" "$INSTDIR\语镜.exe"
  CreateDirectory "$SMPROGRAMS\语镜"
  CreateShortcut "$SMPROGRAMS\语镜\语镜.lnk" "$INSTDIR\语镜.exe"
  CreateShortcut "$SMPROGRAMS\语镜\卸载.lnk" "$INSTDIR\卸载.exe"
  WriteRegStr HKCU "Software\Yujing" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Yujing" "Version" "1.0.0"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\语镜.lnk"
  RMDir /r "$SMPROGRAMS\语镜"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Yujing"
SectionEnd
