import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';

import { MongoClient } from 'mongodb';

const app = express();
const port =  process.env.PORT || 5000;

//mongodb connection
const client = new MongoClient(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dapor4c.mongodb.net/`);

console.log(client);

//middleware
app.use(express.json());


export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectedClient = await connectToMongoDB();



app.get('/', (req, res) => {
  res.send('Wedora is running!');
});



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});