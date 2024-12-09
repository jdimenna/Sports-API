import express from 'express';
import aggregationRoutes from './Routes/aggregation.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/aggregation', aggregationRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});