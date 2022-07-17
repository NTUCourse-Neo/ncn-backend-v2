import { MongoClient } from 'mongodb';
import dotenv from 'dotenv-defaults';
dotenv.config();

const client = new MongoClient(process.env.MONGO_URL);
client.connect();
const collection = client.db('NTUCourse-Neo').collection('1102_courses');

export default collection;