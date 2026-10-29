# สมุดเงินรายวัน

เว็บบันทึกรายรับรายจ่ายภาษาไทย ออกแบบสำหรับมือถือเป็นหลัก หน้าแรกแสดงยอดคงเหลือและรายการล่าสุด พร้อมปฏิทินรายวันด้านล่าง หน้าสถิติแสดงสัดส่วนรายจ่ายตามหมวดหมู่และสรุปรายสัปดาห์ รายเดือน และรายปี ฟอร์มบันทึกใช้หมวดหมู่และแป้นตัวเลขบนหน้าจอ

## เริ่มใช้งาน

เปิด `dist/index.html` ผ่านเว็บเซิร์ฟเวอร์แบบ static เช่น `python -m http.server 8000 --directory dist` แล้วเข้า `http://localhost:8000` ข้อมูลเริ่มต้นเก็บใน localStorage ของเบราว์เซอร์ สามารถส่งออกและนำเข้า CSV ได้

## เชื่อม Supabase

1. สร้างโปรเจกต์ที่ Supabase แล้วรัน `supabase/schema.sql` ใน SQL Editor
2. เปิด Authentication > Providers และเปิด Email ตามต้องการ หากเปิดการยืนยันอีเมล ผู้ใช้ต้องยืนยันก่อนเข้าสู่ระบบ
3. คัดลอก Project URL และ **publishable key** จาก Project Settings > API Keys ไปกรอกในหน้า “ตั้งค่าและซิงก์”
4. สมัครบัญชีหรือเข้าสู่ระบบในเว็บ หากเคยบันทึกข้อมูลในเครื่อง ใช้ปุ่ม “คัดลอกรายการในเครื่องขึ้น Supabase” หลังเข้าสู่ระบบ

ใช้เฉพาะ publishable key ในเบราว์เซอร์ ห้ามใส่ secret key หรือ service role key ข้อมูลแต่ละบัญชีถูกแยกด้วย Row Level Security ในฐานข้อมูล

## โฮสต์ฟรีด้วย Cloudflare Pages

นำโฟลเดอร์ `dist` ขึ้น Cloudflare Pages แบบ Direct Upload หรือเชื่อม Git repository ตั้งค่า build command ว่างและ output directory เป็น `dist` ไม่ต้องมีเซิร์ฟเวอร์หรือ build step หน้าเว็บใช้ CDN สำหรับ Supabase JS เมื่อเชื่อมต่อ Supabase

หลังเผยแพร่ หากใช้ลิงก์ยืนยันอีเมล ให้เพิ่ม URL ของเว็บไซต์ใน Supabase Authentication > URL Configuration > Redirect URLs
