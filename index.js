
const admin = require("firebase-admin");
const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 3000;

const app = express();
app.use(cors({origin: true}));

var serviceAccount = require("./permissions.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://postivenewstitles-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.firestore();

app.get('/get/:collection_name/:domain', (req,res) => {
    (async ()=> {
        try{
            const document = db.collection(req.params.collection_name).doc(req.params.domain);
            let item = await document.get();
            let response = item.data();
            return res.status(200).send(response);
        }catch(error){
            console.log(error);
            return res.status(500).send(error);
        }
    })();
});

app.post('/post/:domain/:title', async (req,res) => {
    try {
        await db.collection("domain").doc(req.params.domain).set({
            title: req.params.title,
            response: "",
        });
        
        console.log("Document successfully written!");
        res.status(200).send('Document successfully written!');
    } catch (error) {
        console.error("Error writing document: ", error);
        res.status(500).send('Error writing document: ' + error);
    }
});

app.listen(port, ()=>{
    console.log("Listening to port: " + port);
});