import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config()
const database = () => {
	mongoose
		.connect(process.env.MONGO_URI, {
		})
		.then(console.log(`DB Connection Success`))
		.catch((err) => {
			console.log(`DB Connection Failed`);
			console.log(err);
			process.exit(1);
		});
};
export default database;