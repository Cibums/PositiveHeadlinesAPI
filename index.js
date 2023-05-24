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

let serviceAccount = {
    "type": "service_account",
    "project_id": process.env.PROJECT_ID,
    "private_key_id": process.env.PRIVATE_KEY_ID,
    "private_key": process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    "client_email": process.env.CLIENT_EMAIL,
    "client_id": process.env.CLIENT_ID,
    "auth_uri": process.env.AUTH_URI,
    "token_uri": process.env.TOKEN_URI,
    "auth_provider_x509_cert_url": process.env.AUTH_PROVIDER_X509_CERT_URL,
    "client_x509_cert_url": process.env.CLIENT_X509_CERT_URL,
    "universe_domain": "googleapis.com"
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL
});

const db = admin.firestore();

app.post('/title', async (req,res) => {
    try {
        const document = db.collection("system").doc("variables");
        let item = await document.get();

        let currentPrompt = item.exists ? item.data().prompt : prompt;

        let titleData = await getHeadlineFromDatabase(req.body.domain, req.body.title, req.body.articleText, currentPrompt);
        res.status(titleData.status).send(titleData.data);

    } catch(error) {
        console.error(error);
        res.status(500).send(error);
    }
});

//Gets a list of all headlines
app.get('/title', async (req,res) => {
    try {
        const headlinesCollection = db.collection("headlines");
        
        await headlinesCollection.get()
        .then((querySnapshot) => {
            var response = getHeadlines(querySnapshot);
            res.status(response.status).send(response.data);
        })
        .catch((error) => {
            res.status(error.status).send(error);
        });

        res.status(500).send("Something went wrong");
    } catch(error) {
        console.error(error);
        res.status(error.status).send(error);
    }
});

//Gets a list of all headlines 
app.get('/title/:domain', async (req,res) => {
    let enc_domain = btoa(encodeURIComponent(req.params.domain));

    try {
        const headlinesCollection = db.collection("headlines");
        
        await headlinesCollection.get().where("enc_domain", "==", enc_domain)
        .then((querySnapshot) => {
            var response = getHeadlines(querySnapshot);
            res.status(response.status).send(response.data);
        })
        .catch((error) => {
            res.status(error.status).send(error);
        });

        res.status(500).send("Something went wrong");
    } catch(error) {
        console.error(error);
        res.status(error.status).send(error);
    }
});

function getHeadlines(querySnapshot){
    var headlines = [];

    querySnapshot.forEach((doc) => {
        let data = doc.data();
        headlines.push(
            {
                enc_title: data.enc_title,
                enc_domain: data.enc_domain,
                newTitle: data.newTitle
            }
        );
    });

    if(headlines.length !== 0){
        return { status: 200, data: headlines }
    }

    return { status: 204, data: undefined }
}

async function getHeadlineFromDatabase(domain, title, articleText, currentPrompt) {

    let enc_domain = btoa(encodeURIComponent(domain));
    let enc_title = btoa(encodeURIComponent(title));

    const document = db.collection("headlines").doc(enc_domain + enc_title);
    let item = await document.get();

    if (!item.exists) {
        const success = await addHeadlineToDatabase(domain, enc_domain, enc_title, articleText, currentPrompt);
        if (!success) throw new Error("Error adding title");

        item = await document.get();
        return { status: 201, data: item.data() };
    }

    return { status: 200, data: item.data() };
}

async function addHeadlineToDatabase(domain, enc_domain, enc_title, articleText, currentPrompt){
    try {
        let newTitle = await getGPTTitle(articleText, currentPrompt);
        await db.collection("headlines").doc(enc_domain + enc_title).set(
            { 
                "newTitle": newTitle,
                "enc_domain": enc_domain,
                "enc_title": enc_title,
            }
        );

        console.log("New title saved in database");
        return true;
    } catch (error) {
        console.error("Error writing document: ", error);
        return false;
    }
}

async function getGPTTitle(articleText, currentPrompt){
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{"role": "user", "content": currentPrompt + articleText}]
    });

    return completion.data.choices[0].message.content;
}

function btoa(string){
    return Buffer.from(string).toString('base64');
}

app.listen(port, ()=>{
    console.log("Listening to port: " + port);
});