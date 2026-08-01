import jwt from 'jsonwebtoken';
import {User} from './models.js';

const secret=()=>process.env.JWT_SECRET||'pca-development-secret-change-in-production';
export const signToken=user=>jwt.sign({sub:user._id.toString(),role:user.role},secret(),{expiresIn:'7d'});

export async function optionalAuth(req,res,next){
  try{const header=req.headers.authorization;if(!header?.startsWith('Bearer '))return next();
    const payload=jwt.verify(header.slice(7),secret());req.user=await User.findById(payload.sub).select('-passwordHash');next();
  }catch{return res.status(401).json({message:'Invalid or expired authentication token'});}
}
export function requireAuth(req,res,next){return req.user?next():res.status(401).json({message:'Sign in required'});}
export function requireAdmin(req,res,next){return req.user?.role==='admin'?next():res.status(403).json({message:'Administrator access required'});}
