; 卸载时询问是否删除用户数据
!macro customUnInstall
  ; 检查用户数据目录是否存在
  StrCpy $0 "$APPDATA\pawkit"
  IfFileExists "$0\*.*" 0 noUserData

  ; 弹窗询问是否删除用户数据
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
    "是否同时删除用户数据？$\n$\n包括：配置、剪贴板历史、颜色收藏、二维码历史等。$\n$\n选择「否」会保留这些数据，方便下次安装时恢复。" \
    IDYES deleteUserData IDNO keepUserData

deleteUserData:
  RMDir /r "$0"
  Goto done

keepUserData:
  Goto done

noUserData:
  ; 用户数据目录不存在，跳过
  Goto done

done:
!macroend
