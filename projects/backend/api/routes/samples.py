import os
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter(tags=["samples"])

class SamplesResponse(BaseModel):
    items: List[str]

@router.get("/samples", response_model=SamplesResponse)
async def get_samples():
    """
    Scans the frontend/public/Samples directory and returns a list of image paths.
    This allows the UI to automatically detect new samples added to the folder.
    """
    # Calculate the path to the Samples directory relative to this file
    # This works because the backend and frontend are siblings in the root
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
    samples_dir = os.path.join(base_dir, "frontend", "public", "Samples")
    
    if not os.path.exists(samples_dir):
        return SamplesResponse(items=[])
    
    try:
        # Filter for common image extensions
        valid_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.webp')
        files = [
            f for f in os.listdir(samples_dir) 
            if f.lower().endswith(valid_extensions)
        ]
        
        # Sort files to maintain a consistent order
        files.sort()
        
        # Return paths relative to the frontend's public root
        return SamplesResponse(items=[f"/Samples/{f}" for f in files])
    except Exception:
        return SamplesResponse(items=[])
