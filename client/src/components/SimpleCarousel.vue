<template>
  <div class="carousel-container">
    <a-carousel autoplay class="custom-carousel">
      <div class="carousel-slide">
        <img src="https://images.unsplash.com/photo-1579427421635-a0015b804b2e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2000&q=80" class="slide-image" />
      </div>
      <div class="carousel-slide">
        <img src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2000&q=80" class="slide-image" />
      </div>
      <div class="carousel-slide">
        <img src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2000&q=80" class="slide-image" />
      </div>
      <div class="carousel-slide">
        <img src="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2000&q=80" class="slide-image" />
      </div>
    </a-carousel>
  </div>
</template>

<script setup>
// 不需要额外导入，a-carousel由Ant Design Vue全局注册
</script>

<style scoped>
.carousel-container {
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
  height: 280px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.custom-carousel {
  height: 100%;
}

.carousel-slide {
  height: 280px;
  overflow: hidden;
}

.slide-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 自定义Ant Design轮播图样式 */
:deep(.slick-dots) {
  margin-bottom: 10px;
}

:deep(.slick-dots li button) {
  background: white !important;
  opacity: 0.7;
}

:deep(.slick-dots li.slick-active button) {
  background: white !important;
  opacity: 1;
}
</style> 