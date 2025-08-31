window.KEY = ''; // 全局KEY变量
// 获取文本的 SHA-256 哈希后，再获取其 SHA-1 哈希（均为 hex 字符串，返回 Promise<string>）
async function getTextSHA256ThenSHA1(text) {
    // 计算SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const sha256Buffer = await crypto.subtle.digest('SHA-256', data);
    const sha256Hex = Array.from(new Uint8Array(sha256Buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    // 计算SHA-1
    const sha1Buffer = await crypto.subtle.digest('SHA-1', encoder.encode(sha256Hex));
    const sha1Hex = Array.from(new Uint8Array(sha1Buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    return sha1Hex;
}

window.onload = () => {
    // KEY提示
    const keyTip = document.getElementById('key-tip');
    function maskKey(key) {
        if (!key) return '';
        if (key.length <= 2) return key.replace(/.(?=.)/g, '*');
        // 保证星号数量与实际密钥长度一致
        if (key.length <= 8) {
            return key[0] + '*'.repeat(key.length - 2) + key[key.length - 1];
        }
        return key[0] + '*'.repeat(key.length - 2) + key[key.length - 1];
    }
    keyTip.textContent = `当前KEY: ${maskKey(window.KEY)}`;

    const content = document.getElementById('content');

    // 字符数量显示元素
    let charCount = document.createElement('div');
    charCount.className = 'char-count-tip';
    charCount.textContent = `字符数: ${content.value.length}`;
    content.parentNode.insertBefore(charCount, content.nextSibling);

    function updateCharCount() {
        charCount.textContent = `字符数: ${content.value.length}`;
    }
    content.addEventListener('input', updateCharCount);

    // 初始化时也更新一次
    updateCharCount();

    document.getElementById('btn-encrypt').onclick = () => {
        if (!KEY) {
            alert('请先输入密钥。');
            return;
        }
        let result = encryptData(content.value, KEY);
        result.then(data => {
            content.value = data;
            updateCharCount();
        }); // Base64字符串，包含所有必要信息
    }

    document.getElementById('btn-decrypt').addEventListener('click', () => {
        if (!KEY) {
            alert('请先输入密钥。');
            return;
        }
        let decrypted = decryptData(content.value, KEY);
        decrypted.then(data => {
            content.value = data;
            updateCharCount();
        }).catch(() => { alert('解密失败,请检查密钥和密文！') }) // 还原明文
    });

    document.getElementById('btn-upload').addEventListener('click', function () {
        document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (evt) {
            document.getElementById('content').value = evt.target.result;
            updateCharCount();
        };
        reader.readAsText(file, 'utf-8');
    });

    document.getElementById('btn-download').addEventListener('click', function () {
        const text = document.getElementById('content').value;
        let filename = prompt('请输入文件名', 'content.txt');
        if (filename === null) {
            // 用户点击了取消，直接返回
            return;
        }
        if (!filename) {
            filename = 'content.txt';
        }
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    document.getElementById('btn-copy').addEventListener('click', function () {
        const textarea = document.getElementById('content');
        const text = textarea.value;
        if (!text) return;

        // 优先使用 Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                // 可选：提示已复制
            }).catch(() => {
                fallbackCopy();
            });
        } else {
            fallbackCopy();
        }

        function fallbackCopy() {
            // 兼容iOS：需要先选中内容
            textarea.focus();
            textarea.setSelectionRange(0, textarea.value.length);
            try {
                document.execCommand('copy');
                // 可选：提示已复制
            } catch (err) {
                // 可选：提示失败
            }
            // 可选：取消选中
            textarea.setSelectionRange(0, 0);
        }
    });

    // 拖拽上传
    document.body.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
    });

    document.body.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (evt) {
            document.getElementById('content').value = evt.target.result;
            updateCharCount();
        };
        reader.readAsText(file, 'utf-8');
    });



    document.getElementById('btn-qr').addEventListener('click', function () {
        // 空内容则提示并取消生成
        if (!content.value || !content.value.trim()) {
            alert('内容为空，请先输入内容再生成二维码。');
            return;
        }
        // 直接弹出二维码窗口，不再弹出输入框
        showQRCodeDialog('', false);
        function showQRCodeDialog(tipText, showKey) {
            // 创建弹窗遮罩
            let modal = document.createElement('div');
            modal.className = 'qr-modal';
            // 弹窗内容
            let dialog = document.createElement('div');
            dialog.className = 'qr-dialog';
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            // ===== 新增：根据内容长度动态调整二维码尺寸 =====
            function getDynamicQRSize(text) {
                // 基础尺寸
                let base = 400;
                let len = text.length;
                if (len <= 300) return base;
                if (len <= 600) return 480;
                if (len <= 900) return 560;
                if (len <= 1200) return 640;
                if (len <= 1800) return 720;
                // 超长内容
                return 800;
            }
            const qrSize = getDynamicQRSize(content.value);
            const padding = 24;
            const fontSize = 16;
            const keyMargin = 21;
            const tipFontSize = 15;
            const tipMargin = 12;
            const keyTip = `KEY: ${maskKey(window.KEY)}`;
            // 动态计算高度
            let canvasHeight = qrSize + padding * 2;
            if (showKey) canvasHeight += fontSize + keyMargin;
            if (tipText) canvasHeight += tipFontSize + tipMargin;
            const canvasWidth = qrSize + padding * 2;

            // 创建全尺寸canvas
            let fullCanvas = document.createElement('canvas');
            fullCanvas.width = canvasWidth;
            fullCanvas.height = canvasHeight;
            let ctx = fullCanvas.getContext('2d');

            // 白底
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 生成二维码（带错误校正级别回退）
            let qrResult;
            try {
                // ===== 新增：内容较多时优先用M/L容错级别 =====
                let levels = [QRCode.CorrectLevel.H, QRCode.CorrectLevel.M, QRCode.CorrectLevel.L];
                if (content.value.length > 600) levels = [QRCode.CorrectLevel.M, QRCode.CorrectLevel.L];
                qrResult = buildQRCodeWithFallback(
                    content.value,
                    qrSize,
                    levels
                );
            } catch (e) {
                alert('内容过长，无法生成二维码。请减少内容或分段生成。');
                document.body.removeChild(modal);
                return;
            }

            setTimeout(() => {
                // 只查找canvas，避免img兼容性问题
                let qrCanvas = qrResult.tmpDiv.querySelector('canvas');
                if (qrCanvas) {
                    // 计算文本起始Y
                    let y = padding + qrSize;
                    ctx.drawImage(qrCanvas, padding, padding, qrSize, qrSize);
                    // 绘制KEY
                    if (showKey) {
                        ctx.font = `${fontSize}px sans-serif`;
                        ctx.fillStyle = "#666";
                        ctx.textAlign = "center";
                        y += keyMargin + fontSize / 2;
                        ctx.fillText(keyTip, canvasWidth / 2, y);
                    }
                    // 绘制提示信息
                    if (tipText) {
                        ctx.font = `bold ${tipFontSize}px sans-serif`;
                        ctx.fillStyle = "#1976d2";
                        y += (showKey ? tipMargin + tipFontSize / 2 : keyMargin + tipFontSize / 2);
                        ctx.fillText(tipText, canvasWidth / 2, y);
                    }
                    showDialog();
                }
                document.body.removeChild(qrResult.tmpDiv);
            }, 50);

            function showDialog() {
                // ===== 新增：缩略图显示 =====
                // 最大显示宽度
                const maxDisplayWidth = 360;
                let scale = 1;
                if (fullCanvas.width > maxDisplayWidth) {
                    scale = maxDisplayWidth / fullCanvas.width;
                }
                // 创建缩略canvas
                let thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = fullCanvas.width * scale;
                thumbCanvas.height = fullCanvas.height * scale;
                let tctx = thumbCanvas.getContext('2d');
                tctx.drawImage(fullCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

                // 包裹缩略canvas
                let wrap = document.createElement('div');
                wrap.className = 'qr-canvas-wrap';
                wrap.style.background = '#fff';
                wrap.style.margin = '0 auto';
                wrap.appendChild(thumbCanvas);

                // 清理旧内容
                while (dialog.firstChild) dialog.removeChild(dialog.firstChild);
                dialog.appendChild(wrap);

                // 按钮容器
                let btnGroup = document.createElement('div');
                btnGroup.style.display = 'flex';
                btnGroup.style.justifyContent = 'center';
                btnGroup.style.gap = '12px';
                btnGroup.style.marginTop = '16px';

                // 保存按钮
                let saveBtn = document.createElement('button');
                saveBtn.textContent = '保存二维码';
                saveBtn.onclick = function () {
                    // 下载全尺寸canvas
                    let a = document.createElement('a');
                    a.href = fullCanvas.toDataURL('image/png');
                    a.download = 'qrcode.png';
                    a.click();
                };

                // 关闭按钮
                let closeBtn = document.createElement('button');
                closeBtn.textContent = '关闭';
                closeBtn.onclick = function () {
                    document.body.removeChild(modal);
                };

                btnGroup.appendChild(saveBtn);
                btnGroup.appendChild(closeBtn);

                dialog.appendChild(btnGroup);
            }
        }
    });

    // Helper: build QR code with fallback ECC levels to avoid "code length overflow"
    function buildQRCodeWithFallback(text, size, levels = [QRCode.CorrectLevel.H, QRCode.CorrectLevel.M, QRCode.CorrectLevel.L]) {
        const tmpDiv = document.createElement('div');
        tmpDiv.style.position = 'absolute';
        tmpDiv.style.left = '-9999px';
        document.body.appendChild(tmpDiv);

        let lastError = null;
        for (const lvl of levels) {
            try {
                tmpDiv.innerHTML = '';
                new QRCode(tmpDiv, {
                    text,
                    width: size,
                    height: size,
                    correctLevel: lvl
                });
                // success
                return { tmpDiv, usedLevel: lvl };
            } catch (e) {
                lastError = e;
            }
        }
        document.body.removeChild(tmpDiv);
        throw lastError || new Error('无法生成二维码');
    }

    const keyInput = document.getElementById('key-input');
    const keyApply = document.getElementById('key-apply');

    // 回车改为点击“应用”按钮
    keyApply.addEventListener('click', function () {
        const newKey = keyInput.value.trim();
        if (newKey) {
            getTextSHA256ThenSHA1(newKey).then(hashedKey => {
                window.KEY = hashedKey;
                keyTip.textContent = `当前KEY: ${maskKey(newKey)}`;
                keyInput.value = '';
            })
        }
    });
}
