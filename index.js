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
        let enc_domain = btoa(encodeURIComponent(req.body.domain));
        let enc_title = btoa(encodeURIComponent(req.body.title));

        let titleData = await getHeadlineFromDatabase(enc_domain, enc_title, req.body.articleText, currentPrompt);
        res.status(titleData.status).send(titleData.data);

    } catch(error) {
        console.error(error);
        res.status(500).send(error);
    }
});

async function getHeadlineFromDatabase(enc_domain, enc_title, articleText, currentPrompt) {
    const document = db.collection(enc_domain).doc(enc_title);
    let item = await document.get();

    if (!item.exists) {
        const success = await addHeadlineToDatabase(enc_domain, enc_title, articleText, currentPrompt);
        if (!success) throw new Error("Error adding title");

        item = await document.get();
        return { status: 201, data: item.data() };
    }

    return { status: 200, data: item.data() };
}

async function addHeadlineToDatabase(enc_domain, enc_title, articleText, currentPrompt){
    try {
        let newTitle = await getGPTTitle(articleText, currentPrompt);
        await db.collection(enc_domain).doc(enc_title).set({ newTitle });

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