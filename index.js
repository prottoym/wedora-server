import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';

const app = express();
const port =  process.env.PORT || 5000;

//middleware
app.use(express.json());


app.get('/', (req, res) => {
  res.send('Wedora is running!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});