const cluster = require('cluster');
const express = require('express')
const https = require('https')
const fs = require('fs')
const app = express()
const port = 9898
const bodyParser = require('body-parser')
const numCPUs = require('os').cpus().length
const path = require('path')
const uuid = require('uuid')
const cors = require('cors')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const TOKEN_SECRET = "XXXXXXC4tetanku"

app.use(cors())
app.options('*', cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
    extended: true
}))


const host = process.env.HOST || 'localhost'
const database = process.env.DATABASENAME || 'catetanku'
var account = {
    connectionLimit: 50,
    host: host,
    port: process.env.DATABASEPORT || 3306,
    database: database,
    user: process.env.DATABASEUSER || 'root',
    password: process.env.DATABASEPASSWORD || '123456'
};

console.log(account)

var mysql = require('mysql');
var pool = mysql.createPool(account);

app.post('/signin/', function (req, res) {
    var objData = {
        username: req.body.username,
        password: req.body.password
    }
    var tableName = 'users';
    var sql = ` select id as id, COLUMN_JSON(doc) as doc from ${database}.${tableName} `;
    pool.query(sql, function (error, results, fields) {
        if (error) {
            console.log(error)
            res.status(200).end(JSON.stringify({
                'status': 'false',
                'message': 'Server Error'
            }));
        } else {
            var userFilterred = results.find(row => {
                row.doc = JSON.parse(row.doc)
                return row.doc.username == objData.username
            })
            if (userFilterred == null) {
                res.status(200).end(JSON.stringify({
                    'status': 'false',
                    'message': 'User Not Found1'
                }));
            } else {
                bcrypt.compare(objData.password, userFilterred.password, (checkPassword) => {
                    if (checkPassword) {
                        var accessToken = generateAccessToken({
                            username: objData.username,
                            role: userFilterred.role
                        })
                        res.status(200).end(JSON.stringify({
                            'status': 'true',
                            'message': accessToken
                        }));
                    } else {
                        res.status(200).end(JSON.stringify({
                            'status': 'false',
                            'message': 'User Not Found2'
                        }));
                    }
                });
            }
        }
    });
});

app.post('/signup/', function (req, res) {
    var objData = {
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
        status: 'active'
    }
    var tableName = 'users';
    var sql = ` select id as id, COLUMN_JSON(doc) as doc from ${database}.${tableName} 
           WHERE COLUMN_GET(${database}.${tableName}.doc,"username" AS CHAR) = "${objData.username}"`;
    pool.query(sql, function (error, results, fields) {
        if (error) {
            console.log(error)
            res.status(200).end(JSON.stringify({
                'status': 'false',
                'message': 'Server Error'
            }));
        } else {
            if (results.length > 0) {
                res.status(200).end(JSON.stringify({
                    'status': 'false',
                    'message': 'User already taken'
                }));
            } else {
                bcrypt.hash(objData.password, 10, (error, hashedPassword) => {
                    objData.password = hashedPassword;
                    var id = uuid.v4();
                    var arrObj = [];
                    Object.keys(objData).forEach(function (head) {
                        var obj = objData[head];
                        arrObj.push(`'${head}'`);
                        arrObj.push(`'${obj}'`);
                    });
                    var sql = ` insert into ${database}.${tableName}(id, doc) values( '${id}', COLUMN_CREATE( ${arrObj.join(',') } ) ) on duplicate key update doc = VALUES(doc)  `;
                    pool.query(sql, function (error, results, fields) {
                        console.log(error, results)
                        res.end(JSON.stringify({
                            'message': JSON.stringify(results)
                        }));
                    });
                });
            }
        }
    });
});

app.post('/webapi/:table/:id', function (req, res) {
    var tableName = req.params.table;
    var id = req.params.id;
    var data = req.body;
    var arrObj = [];
    Object.keys(data).forEach(function (head) {
        var obj = data[head];
        arrObj.push(`'${head}'`);
        arrObj.push(`'${obj}'`);
    });
    var sql = ` insert into ${database}.${tableName}(id, doc) values( '${id}', COLUMN_CREATE( ${arrObj.join(',') } ) ) on duplicate key update doc = VALUES(doc)  `;
    pool.query(sql, function (error, results, fields) {
        console.log(error, results)
        res.end(JSON.stringify({
            'message': JSON.stringify(results)
        }));
    });
});

app.post('/webapi/image/:imagename', function (req, res) {
    
});

app.put('/webapi/:table/:id', function (req, res) {
    var tableName = req.params.table;
    var id = req.params.id;
    var data = req.body;
    var arrObj = [];
    var arrDels = [];
    Object.keys(data).forEach(function (head) {
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
    pool.query(sql1, function (error, results, fields) {
        if (arrDels.length > 0) {
            pool.query(sql2, function (error, results, fields) {
                console.log(error, results)
                res.end(JSON.stringify({
                    'message': JSON.stringify(results)
                }));
            });
        } else {
            console.log(error, results)
            res.end(JSON.stringify({
                'message': JSON.stringify(results)
            }));
        }
    });
});

app.get('/webapi/query', function (req, res) {
    var tableName = req.params.table;
    var sql = decodeURIComponent( req.query.sql);
    pool.query(sql, function (error, results, fields) {
        if (!error) {
            console.log(results)
            if (results.length > 0) {
                var resultObj = results.map((obj) => {
                    console.log(obj.doc.toString())
                    obj.doc = JSON.parse(obj.doc.toString().replace(/\r/, ' ').replace(/\n/, ' '))
                    return obj;
                })
            } else {
                var resultObj = [];
            }
            res.end(JSON.stringify({
                'message': 'true',
                results: resultObj
            }))
        } else {
            res.end(JSON.stringify({
                'message': 'false',
                results: error
            }))
        }
    });
});
app.get('/webapi/:table/:id', function (req, res) {
    var tableName = req.params.table;
    var id = req.params.id;
    var sql = ` select id as id, COLUMN_JSON(doc) as doc from ${database}.${tableName}
    where id = "${id}";`;
    pool.query(sql, function (error, results, fields) {
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
        res.end(JSON.stringify({
            'message': 'true',
            results: resultObj
        }))
    });
});

app.delete('/webapi/:table/:id', function (req, res) {
    var tableName = req.params.table;
    var id = req.params.id;
    var sql = ` delete from ${database}.${tableName} where id = "${id}";`;
    pool.query(sql, function (error, results, fields) {
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
        res.end(JSON.stringify({
            'message': 'true',
            results: resultObj
        }))
    });
});
//app.put('/webapi/:table/:id', next());

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
});
https.createServer({
    key: fs.readFileSync( __dirname + '/key.pem'),
    cert: fs.readFileSync(__dirname + '/cert.pem'),
    passphrase: '4kuG4kr0h'
  }, app).listen(9000, function(){
    console.log("Listening on port with https " + 9000);
  });

var funSelect = function (option) {
    var objValue = {
        table: option.table,
        where: option.where
    };
    var checkValue = isEmpty(option);
}

var isEmpty = function (obj) {
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
var generateAccessToken = function (options) {
    // expires after half and hour (1800 seconds = 30 minutes)
    return jwt.sign({
      username: options.username,
      role: options.role
    }, TOKEN_SECRET, {
      expiresIn: '10800s'
    });
  }