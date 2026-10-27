
import dotenv from "dotenv";
import cloudinary from "./cloudinary";

dotenv.config();

async function testCloudinary() {
  try {
    const result = await cloudinary.api.ping();
    console.log("Cloudinary kết nối thành công!");
    console.log(result);
  } catch (error) {
    console.error("Cloudinary kết nối thất bại:", error);
  }
}

testCloudinary();
