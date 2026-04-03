#!/bin/bash
# 软著源程序 PDF 生成脚本
# 生成前 30 页 + 后 30 页的源代码 PDF

OUTPUT_DIR="./software-copyright"
TEMP_FILE="$OUTPUT_DIR/source_code.txt"
FINAL_PDF="$OUTPUT_DIR/源程序.pdf"

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 清空临时文件
> "$TEMP_FILE"

# 添加页眉信息
echo "========================================" >> "$TEMP_FILE"
echo "软件名称: N.E.K.O" >> "$TEMP_FILE"
echo "版本号: V1.0" >> "$TEMP_FILE"
echo "========================================" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

# 统计需要的行数：30页 × 50行 = 1500行
PAGES=30
LINES_PER_PAGE=50
TOTAL_LINES=$((PAGES * LINES_PER_PAGE))  # 1500行

echo "正在收集源代码..."
echo "需要前 $TOTAL_LINES 行 + 后 $TOTAL_LINES 行"

# 收集所有源代码文件（排除 node_modules、生成文件等）
FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.git/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" \
    ! -path "*/ios/Pods/*" \
    ! -path "*/android/.gradle/*" \
    ! -path "*/android/build/*" \
    ! -path "*/.expo/*" \
    ! -path "*/public/live2d/*" \
    ! -name "*.d.ts" \
    ! -name "*.min.js" \
    -print0 | sort -z)

# 计算总行数
TOTAL=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.git/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" \
    ! -path "*/ios/Pods/*" \
    ! -path "*/android/.gradle/*" \
    ! -path "*/android/build/*" \
    ! -path "*/.expo/*" \
    ! -path "*/public/live2d/*" \
    ! -name "*.d.ts" \
    ! -name "*.min.js" \
    -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')

echo "总代码行数: $TOTAL"

# 生成前 1500 行
echo "" >> "$TEMP_FILE"
echo "========== 【前 30 页】 ==========" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

CURRENT_LINE=0
for FILE in $(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.git/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" \
    ! -path "*/ios/Pods/*" \
    ! -path "*/android/.gradle/*" \
    ! -path "*/android/build/*" \
    ! -path "*/.expo/*" \
    ! -path "*/public/live2d/*" \
    ! -name "*.d.ts" \
    ! -name "*.min.js" \
    | sort); do

    if [ $CURRENT_LINE -ge $TOTAL_LINES ]; then
        break
    fi

    FILE_LINES=$(wc -l < "$FILE" | tr -d ' ')

    echo "" >> "$TEMP_FILE"
    echo "// ========== 文件: $FILE ==========" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    cat "$FILE" >> "$TEMP_FILE"

    CURRENT_LINE=$((CURRENT_LINE + FILE_LINES))
done

# 生成后 1500 行
echo "" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "========== 【后 30 页】 ==========" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

# 反向收集文件
REMAINING=$((TOTAL - TOTAL_LINES))
SKIP_LINES=$REMAINING
CURRENT_LINE=0

for FILE in $(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.git/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" \
    ! -path "*/ios/Pods/*" \
    ! -path "*/android/.gradle/*" \
    ! -path "*/android/build/*" \
    ! -path "*/.expo/*" \
    ! -path "*/public/live2d/*" \
    ! -name "*.d.ts" \
    ! -name "*.min.js" \
    | sort); do

    FILE_LINES=$(wc -l < "$FILE" | tr -d ' ')

    if [ $SKIP_LINES -gt 0 ]; then
        if [ $FILE_LINES -le $SKIP_LINES ]; then
            SKIP_LINES=$((SKIP_LINES - FILE_LINES))
            continue
        else
            # 部分跳过
            tail -n $((FILE_LINES - SKIP_LINES)) "$FILE" > /tmp/partial.txt
            echo "" >> "$TEMP_FILE"
            echo "// ========== 文件: $FILE (续) ==========" >> "$TEMP_FILE"
            echo "" >> "$TEMP_FILE"
            cat /tmp/partial.txt >> "$TEMP_FILE"
            rm /tmp/partial.txt
            SKIP_LINES=0
            continue
        fi
    fi

    echo "" >> "$TEMP_FILE"
    echo "// ========== 文件: $FILE ==========" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    cat "$FILE" >> "$TEMP_FILE"
done

echo "源代码已收集到: $TEMP_FILE"

# 检查是否安装了 enscript (用于生成 PDF)
if command -v enscript &> /dev/null; then
    echo "正在生成 PDF..."
    enscript -p "$OUTPUT_DIR/source_code.ps" -f Courier8 -r --word-wrap "$TEMP_FILE"
    ps2pdf "$OUTPUT_DIR/source_code.ps" "$FINAL_PDF"
    rm "$OUTPUT_DIR/source_code.ps"
    echo "PDF 已生成: $FINAL_PDF"
elif command -v pandoc &> /dev/null; then
    echo "正在使用 pandoc 生成 PDF..."
    pandoc "$TEMP_FILE" -o "$FINAL_PDF" --pdf-engine=xelatex -V mainfont="Courier New" -V geometry:margin=1in
    echo "PDF 已生成: $FINAL_PDF"
else
    echo ""
    echo "========================================"
    echo "未检测到 PDF 生成工具，请手动处理:"
    echo "1. 源代码已保存到: $TEMP_FILE"
    echo "2. 安装工具:"
    echo "   brew install enscript ghostscript"
    echo "   或"
    echo "   brew install pandoc basictex"
    echo "3. 或者直接用 Word/VS Code 打开 txt 文件导出 PDF"
    echo "========================================"
fi
