// API Routes
const express = require("express");
const router = express.Router();
const userController = require("../controller/Usercontroller");

router.post("/register", userController.Signup); //Register API
router.post("/login",userController.signIn ); //Login API
router.get("/getusers",userController.getUsers)

module.exports = router;