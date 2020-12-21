const cluster = require('cluster');
const express = require('express')
const md5 = require('md5')
const app = express()
const port = 9898
const bodyParser = require('body-parser')
const numCPUs = require('os').cpus().length
const path = require('path')
const cors = require('cors')

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))


const host = '172.17.0.1'
const database = 'catetanku'
var account = {
    connectionLimit: 50,
    host: host,
    port: 3307,
    database: database,
    user: 'root',
    password: '123456'
};

var mysql = require('mysql');
var pool = mysql.createPool(account);

//app.post('/webapi/:table', next());
app.post('/webapi/:table/:id', function(req, res) {
    var tableName = req.params.table;
    var id = req.params.id;
    var data = req.body;
    var arrObj = [];
    Object.keys(data).forEach(function(head) {
        var obj = data[head];
        arrObj.push(`'${head}'`);
        arrObj.push(`'${obj}'`);
    });
    var sql = ` insert into ${database}.${tableName}(id, doc) values( '${id}', COLUMN_CREATE( ${arrObj.join(',') } ) ) on duplicate key update doc = VALUES(doc)  `;
    pool.query(sql, function(error, results, fields) {
        console.log(error, results)
        res.end(JSON.stringify({ 'message': JSON.stringify(results) }));
    });
});

app.put('/webapi/:table/:id', function(req, res) {
    var tableName = req.params.table;
    var id = req.params.id;
    var data = req.body;
    var arrObj = [];
    var arrDels = [];
    Object.keys(data).forEach(function(head) {
        var obj = data[head];
        if (obj === '') {
            arrDels.push(`'${head}'`);
        } else {
            arrObj.push(`'${head}'`);
            arrObj.push(`'${obj}'`);
        }
    });
    var sql1 = ` update ${database}.${tableName} set doc = COLUMN_ADD( doc, ${arrObj.join(',') } ) where id = '${id}'`;
    var sql2 = ` update ${database}.${tableName} set doc = COLUMN_DELETE(doc, ${arrDels.join(',') } ) where id = '${id}'`;
    //console.log(sql1, sql2)
    pool.query(sql1, function(error, results, fields) {
        if (arrDels.length > 0) {
            pool.query(sql2, function(error, results, fields) {
                console.log(error, results)
                res.end(JSON.stringify({ 'message': JSON.stringify(results) }));
            });
        } else {
            console.log(error, results)
            res.end(JSON.stringify({ 'message': JSON.stringify(results) }));
        }
    });
});

app.get('/webapi/query', function(req, res) {
    var tableName = req.params.table;
    var sql = req.query.sql;
    pool.query(sql, function(error, results, fields) {
        if (!error) {
            if (results.length > 0) {
                var resultObj = results.map((obj) => {
                    obj.doc = JSON.parse(obj.doc.toString())
                    return obj;
                })
            } else {
                var resultObj = {};
            }
            res.end(JSON.stringify({ 'message': 'true', results: resultObj }))
        } else {
            res.end(JSON.stringify({ 'message': 'false', results: error }))
        }
    });
});
app.get('/webapi/:table/:id', function(req, res) {
    var tableName = req.params.table;
    var id = req.params.id;
    var sql = ` select id as id, COLUMN_JSON(doc) as doc from ${database}.${tableName}
    where id = "${id}";`;
    pool.query(sql, function(error, results, fields) {
        //console.log(error, results)
        if (results.length > 0) {
            var resultObj = results.map((obj) => {
                obj.doc = JSON.parse(obj.doc.toString())
                return obj;
            })
            //console.log(results)
        } else {
            var resultObj = {};
        }
        /*
        if (error)
            throw error;
        res.writeHead(200, headers);
        if (results.length == 1)
            res.end('{"_id":"' + results[0]._id + '","doc":' + results[0].doc.toString() + '}');
        else
            res.end('{}');
        */
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ 'message': 'true', results: resultObj }))
    });
});

app.delete('/webapi/:table/:id', function(req, res) {
    var tableName = req.params.table;
    var id = req.params.id;
    var sql = ` delete from ${database}.${tableName} where id = "${id}";`;
    pool.query(sql, function(error, results, fields) {
        //console.log(error, results)
        if (results.length > 0) {
            var resultObj = results.map((obj) => {
                obj.doc = JSON.parse(obj.doc.toString())
                return obj;
            })
            //console.log(results)
        } else {
            var resultObj = {};
        }
        /*
        if (error)
            throw error;
        res.writeHead(200, headers);
        if (results.length == 1)
            res.end('{"_id":"' + results[0]._id + '","doc":' + results[0].doc.toString() + '}');
        else
            res.end('{}');
        */
        res.end(JSON.stringify({ 'message': 'true', results: resultObj }))
    });
});
//app.put('/webapi/:table/:id', next());

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
})

var funSelect = function(option) {
    var objValue = {
        table: option.table,
        where: option.where
    };
    var checkValue = isEmpty(option);
}

var isEmpty = function(obj) {
    var arr = Object.keys(obj).filter((head) => {
        return (obj[head] === null || obj[head] === undefined || obj[head] === "");
    })
    if (arr.length > 0) return {
        value: true,
        data: arr
    };
    else return {
        value: false,
        data: arr
    };
}
