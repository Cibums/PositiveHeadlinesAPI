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

const serviceAccount = require("./permissions.json");

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

async function getHeadlineFromDatabase(domain, title, articleText, currentPrompt) {
    const document = db.collection(domain).doc(title);
    let item = await document.get();

    if (!item.exists) {
        const success = await addHeadlineToDatabase(domain, title, articleText, currentPrompt);
        if (!success) throw new Error("Error adding title");

        item = await document.get();
        return { status: 201, data: item.data() };
    }

    return { status: 200, data: item.data() };
}

async function addHeadlineToDatabase(domain, title, articleText, currentPrompt){
    try {
        let newTitle = await getGPTTitle(articleText, currentPrompt);
        await db.collection(domain).doc(title).set({ newTitle });

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

app.listen(port, ()=>{
    console.log("Listening to port: " + port);
});