# 現在のディレクトリ配下のtsおよびtsxファイルを取得し、内容をtxtファイルに保存する
$outputFile = "ts_files_code.txt"

# ファイルが既に存在する場合は削除
if (Test-Path $outputFile) {
    Remove-Item $outputFile
}

# tsおよびtsxファイルを検索
$files = Get-ChildItem -Recurse -Include "*.ts", "*.tsx"

foreach ($file in $files) {
    # ファイル名の区切り文字を追加
    Add-Content -Path $outputFile -Value "▽$($file.FullName)▽"
    
    # ファイルの内容をコードブロックとして追加
    Add-Content -Path $outputFile -Value "```"
    Get-Content -Path $file.FullName | ForEach-Object {
        Add-Content -Path $outputFile -Value $_
    }
    Add-Content -Path $outputFile -Value "```"
    
    # 空行を追加
    Add-Content -Path $outputFile -Value ""
}

Write-Host "ファイル保存完了: $outputFile"