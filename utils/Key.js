const crypto=require("crypto")
//Variable to store the generated Key for Cookie Encryption & Decryption
let secretKey;

//Function to generate Key for Cookie Encryption & Decryption
const generateKey = () => {
    secretKey = crypto.randomBytes(32).toString("hex").slice(0, 32);
    return secretKey;
};

//Function to getkey for Cookie Encryption & Decryption
const getKey = () => {
    if (!secretKey) {
        return generateKey();
    }
    return secretKey;
};

module.exports = { generateKey, getKey }; 