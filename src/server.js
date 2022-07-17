import express from 'express';
import dotenv from 'dotenv-defaults';
import router from './routes/index';
import course_router from './routes/courses';
import user_router from './routes/users';
import course_table_router from './routes/course_tables';
import social_router from './routes/social';
import logs_router from './routes/logs';
import cors from 'cors';
import mongoose from 'mongoose';

const app = express();
dotenv.config();

app.use(cors());
app.use(express.json({limit: '5mb'}));
app.use('/api/v1', router);
app.use('/api/v2/courses', course_router);
app.use('/api/v2/course_tables', course_table_router);
app.use('/api/v2/users', user_router);
app.use('/api/v1/social', social_router);
app.use('/api/v1/logs', logs_router);

mongoose.connect(
    process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then((res) => console.log("mongo db connection created"))

app.listen(5000 || process.env.PORT, () => {
  console.log('Server is running on port 5000');
});
