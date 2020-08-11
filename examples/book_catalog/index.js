const hostName = 'localhost'
const PORT = process.env.PORT || 1337
const IP = process.env.IP || '127.0.0.1'

//
// Includes
const path = require('path')

//
// Set up express, body-parser and jsimdb
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const db = require('../../')

const bookSchema = {
    title: {
        type: 'string',
        required: true
    },
    author: {
        type: 'string',
        required: true
    },
    isbn: {
        type: 'string',
        required: true
    },
    publisher: {
        type: 'string'
    },
    pages: {
        type: 'number'
    },
    keywords: {
        type: 'array string'
    }
}

const books = db.relational('books', { books: bookSchema })

//
// Express properties
app.set('views', path.join(__dirname, './'))
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, './')))

//
// Routes
app.get('/', (req, res) => {
    res.render('home', { books: books.getAllEntries('books') })
})

app.get('/search', (req, res) => {
    books.find('books', { any: req.query.q }, (err, result) => {
        if (err) console.log(err)
        res.render('home', { books: result })
    })
})

app.post('/new', (req, res) => {
    req.body.pages = parseInt(req.body.pages)
    books.insert('books', req.body, (err, newBook) => {
        if (err) {
            console.log('insert failed: ', err)
            res.redirect('/')
        }
        books.save(() => {
            res.redirect('/')
        })
    })
})

app.post('/delete/:id', (req, res) => {
    books.delete('books', req.params.id, (err) => {
        if (err) console.log(err)
        books.save()
    })
    res.redirect('/')
})

//
// Listen
app.listen(PORT, IP, () => {
    console.log(`Server listening at \n\t-->http://${hostName}:${PORT}`)
})
