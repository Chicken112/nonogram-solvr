const { exit } = require('process')

let silent = false
exports.silent = silent
exports.message = (msg) => {
    if(this.silent) return
    console.log(`[i] ${msg}\x1b[0m`)
}
exports.warn = (msg) => {
    if(this.silent) return
    console.log(`\x1b[33m[W] ${msg}\x1b[0m`)
}
exports.error = (err) => {
    console.log("\007")
    console.error(`\x1b[31m[E] ${err}\x1b[0m`)
    exit(0)
}