import os
from flask import Flask, render_template, request, jsonify, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'artspace_super_secret' # เปลี่ยนเป็นอะไรก็ได้
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///artspace.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/uploads'

# สร้างโฟลเดอร์เก็บรูปถ้ายังไม่มี
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'artworks'), exist_ok=True)
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'slips'), exist_ok=True)

db = SQLAlchemy(app)

# --- DATABASE MODELS (ตารางฐานข้อมูล) ---

# 1. ตารางผู้ใช้งาน (เก็บ ชื่อ, อีเมล, รหัสผ่าน, สถานะ)
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), default='member') # 'member' หรือ 'admin'

# 2. ตารางผลงานศิลปะ (เก็บข้อมูลภาพ และ ชื่อไฟล์ภาพ)
class Artwork(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(50))
    artist_name = db.Column(db.String(100))
    owner_name = db.Column(db.String(100)) # เจ้าของปัจจุบัน
    image_filename = db.Column(db.String(200)) # เก็บชื่อไฟล์รูปใน static/uploads/artworks
    is_sold = db.Column(db.Boolean, default=False)
    caption = db.Column(db.Text, default="")
    
    # 3. เชื่อมโยงกับสลิป (เก็บชื่อไฟล์สลิป)
    slip_filename = db.Column(db.String(200), nullable=True) # เก็บชื่อไฟล์สลิปใน static/uploads/slips

# สร้าง Database
with app.app_context():
    db.create_all()
    # สร้าง Admin อัตโนมัติถ้ายังไม่มี
    if not User.query.filter_by(email='admin@artspace.com').first():
        admin = User(name='Admin', email='admin@artspace.com', password='admin888', role='admin')
        db.session.add(admin)
        db.session.commit()

# --- ROUTES ---

@app.route('/')
def index():
    return render_template('index.html')

# API: ดึงข้อมูลรูปภาพทั้งหมด
@app.route('/api/artworks', methods=['GET'])
def get_artworks():
    artworks = Artwork.query.all()
    data = []
    for art in artworks:
        data.append({
            'id': art.id,
            'title': art.title,
            'price': art.price,
            'category': art.category,
            'artist': art.artist_name,
            'owner': art.owner_name,
            'img': f"/static/uploads/artworks/{art.image_filename}", # Path รูป
            'isSold': art.is_sold,
            'caption': art.caption
        })
    return jsonify(data)

# API: สมัครสมาชิก
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'success': False, 'message': 'อีเมลนี้ถูกใช้แล้ว'})
    
    new_user = User(name=data['name'], email=data['email'], password=data['password'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'success': True, 'user': {'name': new_user.name, 'email': new_user.email, 'role': new_user.role}})

# API: เข้าสู่ระบบ
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email'], password=data['password']).first()
    if user:
        return jsonify({'success': True, 'user': {'name': user.name, 'email': user.email, 'role': user.role}})
    return jsonify({'success': False, 'message': 'ข้อมูลไม่ถูกต้อง'})

# API: อัปโหลดรูปภาพ (บันทึกไฟล์ลง Server + ชื่อลง DB)
@app.route('/api/upload', methods=['POST'])
def upload_artwork():
    if 'image' not in request.files:
        return jsonify({'success': False, 'message': 'ไม่พบไฟล์ภาพ'})
    
    file = request.files['image']
    title = request.form['title']
    price = request.form['price']
    category = request.form['category']
    artist = request.form['artist']
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'ชื่อไฟล์ว่างเปล่า'})

    if file:
        filename = secure_filename(f"{datetime.now().timestamp()}_{file.filename}")
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], 'artworks', filename))
        
        new_art = Artwork(
            title=title, price=price, category=category,
            artist_name=artist, owner_name=artist, image_filename=filename
        )
        db.session.add(new_art)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False})

# API: ซื้อสินค้า (อัปโหลดสลิป)
@app.route('/api/buy', methods=['POST'])
def buy_artwork():
    art_id = request.form['id']
    buyer_name = request.form['buyer']
    slip_file = request.files['slip']
    
    artwork = Artwork.query.get(art_id)
    if artwork and slip_file:
        # บันทึกสลิป
        slip_filename = secure_filename(f"SLIP_{art_id}_{buyer_name}_{slip_file.filename}")
        slip_file.save(os.path.join(app.config['UPLOAD_FOLDER'], 'slips', slip_filename))
        
        # อัปเดตสถานะสินค้า
        artwork.is_sold = True
        artwork.owner_name = buyer_name
        artwork.slip_filename = slip_filename
        db.session.commit()
        
        return jsonify({'success': True})
    return jsonify({'success': False})

# API: แก้ไขงาน
@app.route('/api/edit', methods=['POST'])
def edit_artwork():
    data = request.json
    art = Artwork.query.get(data['id'])
    if art:
        art.price = data['price']
        art.caption = data['caption']
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False})

# API: ลบงาน (Admin/Owner)
@app.route('/api/delete_art', methods=['POST'])
def delete_art():
    data = request.json
    art = Artwork.query.get(data['id'])
    if art:
        # ลบไฟล์ภาพออกจากเครื่องด้วย (Optional)
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], 'artworks', art.image_filename))
        except:
            pass
        db.session.delete(art)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False})

# API: ลบบัญชี
@app.route('/api/delete_account', methods=['POST'])
def delete_account():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    if user:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False})

# API: รีเซ็ตระบบ
@app.route('/api/reset', methods=['POST'])
def reset_system():
    # ลบข้อมูลในตาราง แต่ไม่ลบตาราง
    db.session.query(Artwork).delete()
    db.session.query(User).delete()
    
    # สร้าง Admin ใหม่
    admin = User(name='Admin', email='admin@artspace.com', password='admin888', role='admin')
    db.session.add(admin)
    db.session.commit()
    return jsonify({'success': True})

# API: ดึง User ทั้งหมด (สำหรับ Admin)
@app.route('/api/users', methods=['GET'])
def get_users():
    users = User.query.all()
    user_list = [{'name': u.name, 'email': u.email, 'role': u.role} for u in users]
    return jsonify(user_list)

# API: ลบ User (Admin สั่งลบ)
@app.route('/api/delete_user', methods=['POST'])
def delete_user():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    if user:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False})

if __name__ == '__main__':
    app.run(debug=True)