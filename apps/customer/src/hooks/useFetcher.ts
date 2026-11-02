"use client";

import axios, { AxiosInstance } from "axios";
import { useCallback, useMemo, useState } from "react";

const authServiceUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL;

const createAxiosInstance = (): AxiosInstance => {
  return axios.create({
    withCredentials: true,
    baseURL: authServiceUrl,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

export const useFetcher = () => {
  const [fetcher] = useState<AxiosInstance>(createAxiosInstance);
  const getData = useCallback(
    async (url: string) => {
      try {
        const response = await fetcher.get(url);
        return response.data;
      } catch (error) {
        console.error("GET request failed:", url, error);
        throw error;
      }
    },
    [fetcher],
  );

  const deleteItem = useCallback(
    async (url: string) => {
      try {
        const response = await fetcher.delete(url);
        return response.data;
      } catch (error) {
        console.error("DELETE request failed:", url, error);
        throw error;
      }
    },
    [fetcher],
  );

  const patchItem = useCallback(
    async <TData>(url: string, { arg }: { arg: TData }) => {
      try {
        const response = await fetcher.patch(url, arg);
        return response.data;
      } catch (error) {
        console.error("PATCH request failed:", url, error);
        throw error;
      }
    },
    [fetcher],
  );

  const postItem = useCallback(
    async <TData>(url: string, { arg }: { arg: TData }) => {
      try {
        const response = await fetcher.post(url, arg);
        return response.data;
      } catch (error) {
        console.error("POST request failed:", url, error);
        throw error;
      }
    },
    [fetcher],
  );

  const putItem = useCallback(
    async <TData>(url: string, { arg }: { arg: TData }) => {
      try {
        const response = await fetcher.put(url, arg);
        return response.data;
      } catch (error) {
        console.error("PUT request failed:", url, error);
        throw error;
      }
    },
    [fetcher],
  );

  return useMemo(
    () => ({
      fetcher,
      getData,
      deleteItem,
      patchItem,
      postItem,
      putItem,
    }),
    [getData, deleteItem, patchItem, postItem, putItem, fetcher],
  );
};
