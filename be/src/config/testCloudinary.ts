
import dotenv from "dotenv";
import { getCloudinary } from "./cloudinary";
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testCloudinary() {
  try {
    const result = await getCloudinary().api.ping();
    console.log("Cloudinary kết nối thành công!");
    console.log(result);
  } catch (error) {
    console.error("Cloudinary kết nối thất bại:", error instanceof Error ? error.name : 'CloudinaryError');
    process.exitCode = 1;
  }
}

testCloudinary();
