const crypto = require("crypto");

// Variable to store the generated Key for Cookie Encryption & Decryption
let secretKey;

// Function to generate Key for Cookie Encryption & Decryption
const generateKey = () => {
    secretKey = crypto.randomBytes(32).toString("hex").slice(0, 32);
    return secretKey;
};

// Function to get key for Cookie Encryption & Decryption
const getKey = () => {
    if (!secretKey) {
        return generateKey();
    }
    return secretKey;
};

// Cookie Encrypt function
const cookieencrypt = (data, secretKey) => {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(secretKey), iv);
        let encrypted = cipher.update(data, "utf8", "hex");
        encrypted += cipher.final("hex");
        return iv.toString("hex") + ":" + encrypted;
    } catch (error) {
        console.error("Encryption Error:", error);
        return null;
    }
};

// Cookie Decrypt function
const cookiedecrypt = (encryptedData, secretKey) => {
    try {
        if (encryptedData && secretKey) {
            const [ivHex, encrypted] = encryptedData.split(":");
            const iv = Buffer.from(ivHex, "hex");
            const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(secretKey), iv);
            let decrypted = decipher.update(encrypted, "hex", "utf8");
            decrypted += decipher.final("utf8");
            return decrypted;
        } else {
            console.error("Missing encrypted data or secret key");
            return null;
        }
    } catch (error) {
        console.error("Decryption Error:", error);
        return null;
    }
};

module.exports = { generateKey, getKey, cookieencrypt, cookiedecrypt };
