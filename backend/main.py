import io
import base64
from typing import Union
from fastapi import FastAPI
from fastapi import HTTPException
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from PIL import Image
import pytesseract
import pymongo
import pandas as pd

from models import Entity


app = FastAPI()

origins = [
    "http://localhost",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_client():
    client = pymongo.MongoClient("localhost", 27017)
    return client


def get_collection(name, db="ocr_annotation"):
    client = get_client()
    db = client[db]
    return db[name]


@app.post("/createentity")
def create_entity(entity: Entity):
    client = get_client()
    db = client["ocr_annotation"]
    collection = db.entity
    if collection.find_one({"name": entity.dict()["name"]}):
        raise HTTPException(
            detail="Entity already exists",
            status_code=404,
            )
    collection.insert_one(jsonable_encoder(entity))
    return entity


@app.get("/entitylist")
def read_entities():
    client = get_client()
    db = client["ocr_annotation"]
    collection = db.entity
    return list(collection.find({}, {"_id": False}))


@app.post("/save")
async def save_annotations(request: Request):
    request = await request.json()
    collection = get_collection("annotations")
    collection.update_one({"imageName": request["imageName"]}, {"$set": request}, upsert=True)
    # collection.insert_one(jsonable_encoder(request))
    return request


@app.post("/getboxes")
async def get_boxes(request: Request):
    request = await request.json()
    imstring = request["image"].split("base64,")[-1].strip()
    imdecoded = base64.b64decode(imstring)
    imbytes = io.BytesIO(imdecoded)
    image = Image.open(imbytes)
    data_df = pd.read_csv(io.StringIO(pytesseract.image_to_data(image)), sep="\t")
    # remove segments
    data_df = data_df[~data_df.text.isna()]
    return data_df.to_json(orient="records")
