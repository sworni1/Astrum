export interface Review {
  id: number;
  userName: string;
  userAvatar: string;
  date: string;
  rating: number;
  content: string;
  likes: number;
  comments: number;
}

export const REVIEWS_PER_PAGE = 2;

export const DEMO_REVIEWS: Review[] = [
  {
    id: 1,
    userName: "Emma Davis",
    userAvatar: "https://notion-avatars.netlify.app/api/avatar?preset=female-1",
    date: "2024-03-20",
    rating: 5,
    content:
      "I was blown away by the quality of this product. It's clear that a lot of thought and care went into its design. The attention to detail is remarkable, and it's been an absolute pleasure to use. I've already recommended it to several friends who are equally impressed with their purchases.",
    likes: 8,
    comments: 2,
  },
  {
    id: 2,
    userName: "Anuj Mishra",
    userAvatar: "https://notion-avatars.netlify.app/api/avatar?preset=male-1",
    date: "2023-12-16",
    rating: 5,
    content:
      "The customer service experience was exceptional from start to finish. When I had questions about my order, the team responded promptly and went above and beyond to ensure I was completely satisfied. It's rare to find such dedication to customer happiness these days.",
    likes: 10,
    comments: 5,
  },
  {
    id: 3,
    userName: "Robert Karmazov",
    userAvatar: "https://notion-avatars.netlify.app/api/avatar?preset=male-2",
    date: "2023-10-24",
    rating: 5,
    content:
      "I was hesitant about the price at first, but after using this product for several weeks, I can confidently say it's worth every penny. The quality and durability are outstanding, and it's made a noticeable difference in my daily routine. I'm already planning to purchase more items from this store.",
    likes: 4,
    comments: 0,
  },
  {
    id: 4,
    userName: "Sophia Chen",
    userAvatar: "https://notion-avatars.netlify.app/api/avatar?preset=female-2",
    date: "2024-05-15",
    rating: 4,
    content:
      "This is a fantastic product that has really improved my daily routine. The quality is excellent and it's very user-friendly. The only reason I'm not giving it 5 stars is that I wish it came in more color options. Other than that, it's been a great purchase and I would definitely recommend it to others.",
    likes: 6,
    comments: 1,
  },
];
