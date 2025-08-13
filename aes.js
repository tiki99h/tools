/**
 * 检查浏览器是否支持 Web Crypto API
 */
function checkCryptoSupport() {
  if (!window.crypto || !window.crypto.subtle) {
    alert("您的浏览器不支持 Web Crypto API，请使用现代浏览器 (如 Chrome, Firefox, Edge)。");
    throw new Error("Web Crypto API not supported");
  }
}

/**
 * 使用 AES-GCM 加密数据。
 * @param {string} plaintext - 要加密的明文字符串。
 * @param {string} password - 用于派生加密密钥的密码。
 * @returns {Promise<string>} - 一个解析为 Base64 编码的加密字符串的 Promise。
 */
async function encryptData(plaintext, password) {
  checkCryptoSupport();
  try {
    const textEncoder = new TextEncoder();
    const data = textEncoder.encode(plaintext);

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      textEncoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt']
    );

    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );

    const encryptedArray = new Uint8Array(encryptedData);
    const result = new Uint8Array(salt.length + iv.length + encryptedArray.length);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(encryptedArray, salt.length + iv.length);

    return btoa(String.fromCharCode.apply(null, result));
  } catch (error) {
    console.error('加密失败:', error);
    throw error;
  }
}

/**
 * 使用 AES-GCM 解密数据。
 * @param {string} base64String - 从 encryptData 函数获取的 Base64 编码字符串。
 * @param {string} password - 用于派生解密密钥的密码。
 * @returns {Promise<string>} - 一个解析为原始明文字符串的 Promise。
 */
async function decryptData(base64String, password) {
  checkCryptoSupport();
  try {
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    const binaryString = atob(base64String);
    const data = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      data[i] = binaryString.charCodeAt(i);
    }

    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const encryptedData = data.slice(28);

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      textEncoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['decrypt']
    );

    const decryptedData = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedData
    );

    return textDecoder.decode(decryptedData);
  } catch (error) {
    console.error('解密失败:', error);
    // 如果密码错误或数据损坏，解密会失败
    throw new Error("解密失败，请检查密码或数据是否正确。");
  }
}