'use strict'

let Redul = null

if (process.env.NODE_ENV === 'production') {
    Redul = require('./build/redul.production')
} else {
    Redul = require('./build/redul.development')
}

module.exports = Redul.default || Redul
