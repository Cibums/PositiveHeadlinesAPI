
const admin = require("firebase-admin");
const express = require('express');
const cors = require('cors');
const { Configuration, OpenAIApi } = require("openai");
const port = process.env.PORT || 3000;

const app = express();
app.use(cors({origin: true}));
app.use(express.json());

var prompt = "Here's a news article. I don't know what language this is in, but give me a title of this article. The title should be in the language of the article and you should keep it short and informative. It should not be clickbait. The title should accurately describe the content of the article and you should try to make it as positive as possible. If the article is not a positive one, then try to make the title as positive as possible. But remember that the title should be accurate and truthful to the article's contents. That's the most important part. The title you give me should always be true, based on the articles's content. It's also very important that your response is only the title itself. You should only respond with the title. Nothing else than the title should be included in your response. Do not include translations, or citation marks. Do not include anything in your response that is not the title itself. Here's the article: ";

var serviceAccount = require("./permissions.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://postivenewstitles-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.firestore();

app.post('/title', (req,res) => {
    (async ()=> {

        if(promptGottenOnce === false){
            try {
                getDocument();
            } catch (error) {
                console.log(error);
            }
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
        apiKey: process.env.OPENAI_API_KEY || "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",
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

async function getDocument() {
    const document = db.collection("system").doc("variables");
    let item = await document.get();

    if (item.exists) {
        let response = item.data();
        prompt = response.prompt;
    }
}

function btoa(string){
    return Buffer.from(string).toString('base64');
}

app.listen(port, ()=>{
    console.log("Listening to port: " + port);
});