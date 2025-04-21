    // การเปลี่ยนค่าเมื่อคลิก
    const slider = document.getElementById('slider');
    const items = slider.querySelectorAll('.slider-item');
    let currentIndex = 0;

    // เพิ่ม event listener สำหรับการคลิก
    slider.addEventListener('click', () => {
        // ลบ active จากไอเท็มเดิม
        items[currentIndex].classList.remove('active');

        // หาตำแหน่งไอเท็มถัดไป
        currentIndex = (currentIndex + 1) % items.length;

        // เพิ่ม active ให้กับไอเท็มถัดไป
        items[currentIndex].classList.add('active');
    });