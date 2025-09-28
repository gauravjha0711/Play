const ayncHandler = (requestHandler) => {
    (req,res,next)=>{
        Promise.resolve(requestHandler(req,res,next)).catch((err)=>{next(err)});
    }
}

export {ayncHandler};


// const asyncHandler = (requestHandler) => async (req,res,next) => {
//     try{
//         await requestHandler(req,res,next);
//     }catch(err){
//         res.status(err.code || 500).json({
//             success: false,
//             message: err.message || "Internal Server Error"
//         })
//     }
// }