require('dotenv').config()
const admin = require("firebase-admin");
const express = require('express');
const cors = require('cors');
const { Configuration, OpenAIApi } = require("openai");
const port = process.env.PORT || 3000;

const app = express();
app.use(cors({origin: true}));
app.use(express.json());

const prompt = "Give me a headline to this article. Your response should be only the headline and nothing else. Here's the article: ";

var serviceAccount = require("./permissions.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL
});

const db = admin.firestore();

app.post('/title', (req,res) => {
    (async ()=> {
        const document = db.collection("system").doc("variables");
        let item = await document.get();

        if (item.exists) {
            let response = item.data();
            prompt = response.prompt;
        }

        var utf8Domain = encodeURIComponent(req.body.domain);
        var enc_domain = btoa(utf8Domain);
        var utf8Title = encodeURIComponent(req.body.title);
        var enc_title = btoa(utf8Title);

        try{
            const document = db.collection(enc_domain).doc(enc_title);
            let item = await document.get();
            let response = item.data();

            if(!item.exists){
                if(await addTitle(req.body.domain, req.body.title, req.body.articleText)){
                    const document = db.collection(enc_domain).doc(enc_title);
                    let item1 = await document.get();
                    let response1 = item1.data();
                    return res.status(201).send(response1);
                }
                else{
                    return res.status(500).send(error);
                }
            }

            return res.status(200).send(response);
        }catch(error){
            console.log(error);
            
            return res.status(500).send(error);
        }
    })();
});

async function getGPTTitle(articleText){
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{"role": "user", "content": prompt + articleText}]
    });

    return completion.data.choices[0].message.content;
}

async function addTitle(domain, title, articleText){
    try {
        var nt = await getGPTTitle(articleText);

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