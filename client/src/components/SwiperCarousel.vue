<template>
  <div class="swiper-container">
    <swiper 
      :modules="modules" 
      :navigation="true" 
      :pagination="{ clickable: true }" 
      :autoplay="{ delay: 4000, disableOnInteraction: false }" 
      :loop="true"
      effect="fade"
      class="my-swiper">
      <swiper-slide>
        <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2000&q=80" class="slide-image" />
      </swiper-slide>
      <swiper-slide>
        <img src="https://images.unsplash.com/photo-1472214103451-9374bd1c798e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2000&q=80" class="slide-image" />
      </swiper-slide>
      <swiper-slide>
        <img src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2000&q=80" class="slide-image" />
      </swiper-slide>
      <swiper-slide>
        <img src="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2000&q=80" class="slide-image" />
      </swiper-slide>
    </swiper>
  </div>
</template>

<script setup>
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Navigation, Pagination, Autoplay, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

const modules = [Navigation, Pagination, Autoplay, EffectFade];
</script>

<style scoped>
.swiper-container {
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
  height: 250px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.my-swiper {
  width: 100%;
  height: 100%;
}

.slide-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style> 