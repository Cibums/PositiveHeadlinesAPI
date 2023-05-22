
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

app.get('/get/:domain/:title', (req,res) => {
    (async ()=> {

        var utf8Domain = encodeURIComponent(req.params.domain);
        var enc_domain = btoa(utf8Domain);
        var utf8Title = encodeURIComponent(req.params.title);
        var enc_title = btoa(utf8Title);

        try{
            const document = db.collection(enc_domain).doc(enc_title);
            let item = await document.get();
            let response = item.data();
            return res.status(200).send(response);
        }catch(error){
            console.log(error);
            if(await addTitle(req.params.domain, req.params.title)){
                const document = db.collection(enc_domain).doc(enc_title);
                let item = await document.get();
                let response = item.data();
                return res.status(201).send(response);
            }
            else{
                return res.status(500).send(error);
            }
        }
    })();
});

async function getGPTTitle(title){
    return "ny titel";
}

async function addTitle(domain, title){
    try {
        var nt = await getGPTTitle(title);

        var utf8Domain = encodeURIComponent(domain);
        var enc_domain = btoa(utf8Domain);
        var utf8Title = encodeURIComponent(title);
        var enc_title = btoa(utf8Title);

        await db.collection(enc_domain).doc(enc_title).set({
            newTitle: nt,
        });
        
        console.log("New title saved in database");
        return true;
    } catch (error) {
        console.error("Error writing document: ", error);
        return false;
    }
}

function btoa(string){
    return Buffer.from(string).toString('base64');
}

app.listen(port, ()=>{
    console.log("Listening to port: " + port);
});