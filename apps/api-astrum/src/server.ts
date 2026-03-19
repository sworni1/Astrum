import 'reflect-metadata';
import app from "./app";

const PORT = 3580;

app.listen(PORT, () => {
  console.log(`API Gateway running at http://localhost:${PORT}/api`);
});
