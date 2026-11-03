const PASSWORD_GUIDANCE = "Password must have at least 8 characters, uppercase and lowercase letters, a number and a special character (maximum 72 bytes).";
function validPassword(password) {
    return typeof password === "string" &&
        password.length >= 8 &&
        Buffer.byteLength(password, "utf8") <= 72 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9\s]/.test(password);
}
module.exports = { validPassword, PASSWORD_GUIDANCE };
