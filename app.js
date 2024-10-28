const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null
const app = express()
app.use(express.json()) //middle ware

const initialdbserver = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server is running at port 3000')
    })
  } catch (e) {
    console.log(`Db Error:${e.message}`)
    process.exit(1)
  }
}
initialdbserver()

const accesstoken = (request, response, next) => {
  let jwttoken
  const authheader = request.headers['authorization']
  if (authheader !== undefined) {
    jwttoken = authheader.split(' ')[1]
  }
  if (jwttoken === undefined) {
    response.status(401)
    response.send('Invalid Access Token')
  } else {
    jwt.verify(jwttoken, 'NEW_ACCESS', async (err, payload) => {
      if (err) {
        response.status(401)
        response.send('Invalid  jwt  Token')
      } else {
        next()
      }
    })
  }
}

const changedbtoresponseobj = result => {
  return {
    stateId: result.state_id,
    stateName: result.state_name,
    population: result.population,
  }
}

const change = result => {
  return {
    districtId: result.district_id,
    districtName: result.district_name,
    stateId: result.state_id,
    cases: result.cases,
    cured: result.cured,
    active: result.active,
    deaths: result.deaths,
  }
}
//get API 1
app.post('/login/', async (request, response) => {
  const {username, password} = request.body

  const getuserdetialsfordb = `SELECT *
  FROM user
  WHERE
  username='${username}';`
  const dbresult = await db.get(getuserdetialsfordb)
  if (dbresult === undefined) {
    response.status(400)
    response.send('Invalid User')
  } else {
    const ispasswordMatched = await bcrypt.compare(password, dbresult.password)
    if (ispasswordMatched === true) {
      const payload = {
        username: username,
      }

      const jwttoken = jwt.sign(payload, 'NEW_ACCESS')
      response.send({jwttoken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//api 2

app.get('/states/', accesstoken, async (request, response) => {
  const getuserdetialsfordb = `SELECT *
  FROM state;`
  const dbresult = await db.all(getuserdetialsfordb)
  response.send(dbresult.map(eachobj => changedbtoresponseobj(eachobj)))
})

//api 3
app.get('/states/:stateId/', accesstoken, async (request, response) => {
  const {stateId} = request.params
  const getuserdetialsfordb = `SELECT *
   FROM state
   WHERE
   state_id='${stateId}';`
  const dbresult = await db.get(getuserdetialsfordb)
  response.send(changedbtoresponseobj(dbresult))
})

//api 4
app.post('/districts/', accesstoken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const createuserdetails = `INSERT INTO 
  district(district_name,state_id,cases,cured,active,deaths)
  VALUES('${districtName}',
  '${stateId}',
  '${cases}',
  '${cured}',
  '${active}',
  '${deaths}'
  
  
  );`
  const dbresult = await db.run(createuserdetails)
  response.send('District Successfully Added')
})

//api 5

app.get('/districts/:districtId/', accesstoken, async (request, response) => {
  const {districtId} = request.params
  const getdbdetails = `SELECT *
  FROM district
  WHERE 
  district_id='${districtId}';`
  const dbresult = await db.get(getdbdetails)
  response.send(change(dbresult))
})

//api 6
app.delete(
  '/districts/:districtId/',
  accesstoken,

  async (request, response) => {
    const {districtId} = request.params
    const dbdeletequery = `DELETE FROM district
WHERE district_id='${districtId}';`
    const dbresult = await db.run(dbdeletequery)
    response.send('District Removed')
  },
)

//api 7
app.put('/districts/:districtId/', accesstoken, async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const updatequery = `UPDATE district
SET
district_id='${districtName}',
state_id='${stateId}',
cases='${cases}',
cured='${cured}',
active='${active}',
deaths='${deaths}'
WHERE 
district_id='${districtId}';`

  const dbresult = await db.run(updatequery)
  response.send('District Details Updated')
})

//api 8

app.get('/states/:stateId/stats/', accesstoken, async (request, response) => {
  const {stateId} = request.params

  const query = `SELECT 
  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths)
  FROM  district
  WHERE
  state_id='${stateId}';`
  const result = await db.get(query)
  response.send({
    totalCases: result['SUM(cases)'],
    totalCured: result['SUM(cured)'],
    totalActive: result['SUM(active)'],
    totalDeaths: result['SUM(deaths)'],
  })
})

module.exports = app
